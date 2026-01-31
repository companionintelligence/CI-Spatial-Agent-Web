import { useState, useEffect } from "react";

export const useHasWebGPU = () => {
    const [available, setAvailable] = useState<boolean>(true);
  
    useEffect(() => {
      async function checkWebGPU() {
        if (!("gpu" in navigator)) {
          setAvailable(false);
          return;
        }
        try {
          const adapter = await navigator.gpu.requestAdapter();
          setAvailable(!!adapter);
        } catch {
          setAvailable(false);
        }
      }
      checkWebGPU();
    }, []);
  
    return available;
  }