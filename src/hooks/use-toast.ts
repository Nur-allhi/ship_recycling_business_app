
"use client"

// Inspired by react-hot-toast library
import { toast as sonnerToast, Toaster as SonnerToaster } from "sonner";

const useToast = () => {
  return {
    toast: sonnerToast,
  }
}

// Re-exporting the Toaster component from sonner
const Toaster = SonnerToaster;

// Re-exporting the toast function for convenience
const toast = sonnerToast;

export { useToast, Toaster, toast };
