
"use client"

// Inspired by react-hot-toast library
import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"
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
