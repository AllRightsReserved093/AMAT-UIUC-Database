/*
文件功能：预留翼型缩略预览组件的位置，后续负责 SVG 或懒加载预览图的渲染。
File purpose: Reserves the airfoil preview component location for rendering SVG previews or lazy-loaded preview images.
*/

import heroPreviewImage from '../../assets/hero.png'

type AirfoilPreviewProps = {
  label?: string
}

// 中文：渲染翼型预览占位图，后续可替换为真实几何缩略图或懒加载预览图。
// English: Renders the placeholder airfoil preview image, to be replaced later by real geometry thumbnails or lazy-loaded previews.
function AirfoilPreview({ label = 'Airfoil preview placeholder' }: AirfoilPreviewProps) {
  return (
    <img
      alt={label}
      className="airfoil-preview-image"
      src={heroPreviewImage}
    />
  )
}

export default AirfoilPreview
