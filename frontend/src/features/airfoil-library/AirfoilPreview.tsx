/*
文件功能：预留翼型缩略预览组件的位置，后续负责 SVG 或懒加载预览图的渲染。
File purpose: Reserves the airfoil preview component location for rendering SVG previews or lazy-loaded preview images.
*/

import { memo } from 'react'
import heroPreviewImage from '../../assets/hero.png'

type AirfoilPreviewProps = {
  label?: string
  path?: string
}

// 中文：优先渲染真实翼型 SVG path；没有 path 时回退到占位图。
// English: Renders the real airfoil SVG path first, falling back to the placeholder image when no path exists.
const AirfoilPreview = memo(function AirfoilPreview({
  label = 'Airfoil preview placeholder',
  path,
}: AirfoilPreviewProps) {
  if (path) {
    return (
      <svg
        aria-label={label}
        role="img"
        viewBox="0 0 240 80"
      >
        <path className="airfoil-shape" d={path} vectorEffect="non-scaling-stroke" />
      </svg>
    )
  }

  return (
    <img
      alt={label}
      className="airfoil-preview-image"
      src={heroPreviewImage}
    />
  )
})

export default AirfoilPreview
