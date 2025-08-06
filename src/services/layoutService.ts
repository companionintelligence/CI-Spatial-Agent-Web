import { useEffect, } from 'react'
import { useSimpleStore } from '../utils/SimpleStore'

export const useResponsiveLayout = (breakpoint: number = 1000) => {
  const [isMobile, setIsMobile] = useSimpleStore(() => false)

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
