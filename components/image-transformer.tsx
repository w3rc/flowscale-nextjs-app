"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { FlowscaleAPI } from "flowscale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { X, Upload, Image as ImageIcon, RefreshCw, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Types from the provided code
interface FlowscaleResponse {
  status: string;
  runId: string;
  data: {
    download_url: string;
    generation_status: string;
  };
}

interface RunOutput {
  filename: string;
  url: string;
}

interface Run {
  _id: string;
  status: string;
  outputs: RunOutput[];
}

interface RunsResponse {
  status: string;
  data: {
    group_id: string;
    count: number;
    runs: Run[];
  };
}

if (!process.env.NEXT_PUBLIC_FLOWSCALE_API_KEY) {
  throw new Error('NEXT_PUBLIC_FLOWSCALE_API_KEY is not defined');
}

if (!process.env.NEXT_PUBLIC_FLOWSCALE_API_URL) {
  throw new Error('NEXT_PUBLIC_FLOWSCALE_API_URL is not defined');
}

if (!process.env.NEXT_PUBLIC_FLOWSCALE_WORKFLOW_ID) {
  throw new Error('NEXT_PUBLIC_FLOWSCALE_WORKFLOW_ID is not defined');
}

const apiKey = process.env.NEXT_PUBLIC_FLOWSCALE_API_KEY;
const apiUrl = process.env.NEXT_PUBLIC_FLOWSCALE_API_URL;
const workflowId = process.env.NEXT_PUBLIC_FLOWSCALE_WORKFLOW_ID;

const flowscale = new FlowscaleAPI({
  apiKey,
  baseUrl: apiUrl,
  allowDangerouslyExposeApiKey: true,
});

export function ImageTransformer() {
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [promptText, setPromptText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [outputImageUrl, setOutputImageUrl] = useState("");
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [pastRuns, setPastRuns] = useState<Run[]>([]);
  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.size <= 10 * 1024 * 1024) { // 10MB limit
      setInputFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      alert("File size must be less than 10MB");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    },
    maxSize: 10 * 1024 * 1024,
    multiple: false
  });

  const startProgressSimulation = () => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return prev;
        }
        return prev + 5;
      });
    }, 500);
  };

  const handleRemoveImage = () => {
    setInputFile(null);
    setPreviewUrl("");
  };

  const handleCancel = async () => {
    if (currentRunId) {
      try {
        await flowscale.cancelRun(currentRunId);
        setIsLoading(false);
        setCurrentRunId(null);
        setUploadProgress(0);
      } catch (error) {
        console.error("Error cancelling run:", error);
      }
    }
  };

  const fetchPastRuns = async () => {
    try {
      const response = await flowscale.getRuns() as RunsResponse;
      setPastRuns(response.data.runs);
    } catch (error) {
      console.error("Error fetching past runs:", error);
    }
  };

  const generateImage = async () => {
    if (!inputFile) {
      alert('Please select an image first');
      return;
    }

    setIsLoading(true);
    startProgressSimulation();

    try {
      const inputs = {
        image_22068: inputFile,
        default_value_48043: promptText
      };

      setOutputImageUrl('');
      setUploadProgress(0);
      const result = await flowscale.executeWorkflowAsync(workflowId, inputs) as FlowscaleResponse;
      setCurrentRunId(result.runId);
      
      if (result.status === 'success' && result.data.generation_status === 'success') {
        setUploadProgress(100);
        setOutputImageUrl(result.data.download_url);
        await fetchPastRuns();
      } else {
        throw new Error('Generation failed');
      }
    } catch (error: any) {
      console.error('Error processing image:', error);
      if (typeof error.message === 'string' && error.message.includes('timed out')) {
        alert('Image processing took too long to complete. Please try again.');
      } else {
        alert('Error processing image. Please try again.');
      }
    } finally {
      setIsLoading(false);
      setCurrentRunId(null);
    }
  };

  useEffect(() => {
    fetchPastRuns();
  }, []);

  return (
    <div className="grid md:grid-cols-2 gap-8">
      {/* Input Section */}
      <div className="space-y-6">
        <div className="backdrop-blur-lg bg-white/10 rounded-xl p-6 border border-white/20">
          <h2 className="text-xl font-semibold mb-4">Input Image</h2>
          <div className="space-y-4">
            <Input
              placeholder="Enter your prompt..."
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="bg-white/5 border-white/20 text-white"
            />
            
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                isDragActive ? "border-blue-500 bg-blue-500/10" : "border-white/20 hover:border-white/40",
                previewUrl ? "border-none p-0" : ""
              )}
            >
              <input {...getInputProps()} />
              {previewUrl ? (
                <div className="relative group">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage();
                    }}
                    className="absolute top-2 right-2 p-2 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Upload className="w-12 h-12 mb-4 text-white/60" />
                  <p className="text-white/60">
                    Drag & drop an image here, or click to select
                  </p>
                  <p className="text-sm text-white/40 mt-2">
                    Supports PNG, JPG, GIF up to 10MB
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Output Section */}
      <div className="space-y-6">
        <div className="backdrop-blur-lg bg-white/10 rounded-xl p-6 border border-white/20">
          <h2 className="text-xl font-semibold mb-4">Generated Image</h2>
          
          {isLoading && (
            <div className="space-y-4">
              <div className="text-center text-white/60">Generating...</div>
              <div className="flex justify-end">
                <Button
                  variant="destructive"
                  onClick={handleCancel}
                  className="bg-red-500 hover:bg-red-600"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {outputImageUrl && !isLoading && (
            <div className="space-y-4">
              <img
                src={outputImageUrl}
                alt="Generated"
                className="w-full h-64 object-cover rounded-lg"
              />
            </div>
          )}

          {!isLoading && !outputImageUrl && (
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-white/20 rounded-lg">
              <div className="text-center text-white/60">
                <ImageIcon className="w-12 h-12 mx-auto mb-4" />
                <p>Generated image will appear here</p>
              </div>
            </div>
          )}
        </div>

        <Button
          onClick={generateImage}
          disabled={!inputFile || isLoading}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            "Transform Image"
          )}
        </Button>
      </div>
    </div>
  );
}