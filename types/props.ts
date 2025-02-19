import { Dispatch } from 'react'

export interface EditorProps {
  canvasId?: string
  canvasType?: string
  handleRemoveClick: () => void
  hideCanvas?: boolean
  setInput?: Dispatch<any>
  source_image?: string
  source_image_height?: number
  source_image_width?: number
  canvasHeight?: number
  canvasWidth?: number
  toolbarClassName?: string
  editorClassName?: string
  toolbarAbsolute?: boolean
  toolbarDisableMenu?: boolean
}
