
"use client"

// Inspired by react-hot-toast library
import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"
import { toast as sonnerToast } from "sonner";

const useToast = () => {
  return {
    toast: sonnerToast,
  }
}

const Toaster = ({...props}) => {
  return <sonnerToast {...props} />
}

export { useToast, Toaster, toast };
