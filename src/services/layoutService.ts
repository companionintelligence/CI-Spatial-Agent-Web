import { useEffect, useState } from 'react'

export const useResponsiveLayout = (breakpoint: number = 1000) => {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= breakpoint)
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)

    return () => window.removeEventListener('resize', checkScreenSize)
  }, [breakpoint])

  return { isMobile }
}
