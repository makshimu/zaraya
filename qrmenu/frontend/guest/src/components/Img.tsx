import { useState } from 'react'

/** Lazy image in a fixed box so the layout doesn't jump while it loads on a slow network. */
export default function Img({
  src,
  className = '',
  eager = false,
}: {
  src?: string
  className?: string
  eager?: boolean
}) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className={`overflow-hidden bg-cream ${className}`}>
      {src && (
        <img
          src={src}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`size-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  )
}
