"use client"

import { ChakraProvider, defaultSystem } from "@chakra-ui/react"

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider value={defaultSystem} forcedTheme="dark">
      <div className="chakra-theme dark" data-theme="dark">
        {children}
      </div>
    </ChakraProvider>
  )
}
