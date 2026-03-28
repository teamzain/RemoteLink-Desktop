import React from 'react'
import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'

interface ScrollRevealProps {
  children: React.ReactNode
  width?: 'fit-content' | '100%'
  delay?: number
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({ children, width = '100%', delay = 0.2 }) => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.3 })

  return (
    <div ref={ref} style={{ position: 'relative', width, overflow: 'hidden' }}>
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 75 },
          visible: { opacity: 1, y: 0 },
        }}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        transition={{ duration: 0.5, delay }}
      >
        {children}
      </motion.div>
    </div>
  )
}
