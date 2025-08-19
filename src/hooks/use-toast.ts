
"use client"

// Inspired by react-hot-toast library
import { toast } from "sonner";

const useToast = () => {
  return {
    toast,
  }
}

export { useToast, toast };
