import { modelInfoStore } from '../store/modelStore'
import {
  ArtBotJobTypes,
  Common,
  ICanvas,
  ImageMimeType,
  JobStatus
} from '../types'
import { uuidv4 } from '../utils/appUtils'
import { randomSampler } from '../utils/imageUtils'
import { SourceProcessing } from '../utils/promptUtils'

export interface IRequestParams {
  artbotJobType: ArtBotJobTypes
  canvasStore?: ICanvas
  cfg_scale: number
  denoising_strength?: number
  height: number
  imageMimeType: ImageMimeType
  karras: boolean
  models: Array<string>
  negative?: string
  orientation: string
  parentJobId?: string
  post_processing?: Array<string>
  prompt: string
  sampler: string
  source_image?: string
  source_mask?: string
  source_processing: SourceProcessing
  steps: number
  triggers?: Array<string>
  width: number
}

class RerollImageRequest {
  canvasStore?: ICanvas
  cfg_scale: number
  denoising_strength: number | Common.Empty
  height: number
  imageMimeType: ImageMimeType
  jobId?: string
  jobStatus: JobStatus
  jobTimestamp: number
  karras: boolean
  models: Array<string>
  negative: string
  numImages: number
  orientation: string
  parentJobId: string
  post_processing: Array<string>
  prompt: string
  sampler: string
  source_image: string
  source_mask: string
  source_processing: SourceProcessing
  steps: number
  timestamp?: number
  triggers: Array<string>
  width: number

  constructor({
    canvasStore,
    cfg_scale = 7,
    denoising_strength = 0.75,
    height = 512,
    imageMimeType = ImageMimeType.WebP,
    karras = true,
    models = [],
    negative = '',
    orientation = 'square',
    parentJobId = '',
    post_processing = [],
    prompt = '',
    sampler = 'k_euler',
    source_image = '',
    source_mask = '',
    source_processing = SourceProcessing.Prompt,
    steps = 20,
    triggers = [],
    width = 512
  }: IRequestParams) {
    if (canvasStore) {
      this.canvasStore = canvasStore
    }

    this.cfg_scale = Number(cfg_scale)
    this.imageMimeType = imageMimeType
    this.jobStatus = JobStatus.Waiting
    this.jobTimestamp = Date.now()

    this.orientation = String(orientation)
    this.width = Number(width)
    this.height = Number(height)

    this.karras = Boolean(karras)

    if (models[0] === 'random') {
      const currentModels = modelInfoStore.state.availableModelNames
      const randomModel =
        currentModels[Math.floor(Math.random() * currentModels.length)]
      this.models = [randomModel]
    } else {
      this.models = [...models]
    }

    this.negative = String(negative)
    this.numImages = 1
    this.parentJobId = String(parentJobId) || uuidv4()
    this.post_processing = [...post_processing]
    this.prompt = prompt ? String(prompt).trim() : ''

    if (sampler === 'random') {
      const isImg2Img = source_processing !== SourceProcessing.Prompt
      this.sampler = randomSampler(steps, isImg2Img)
    } else {
      this.sampler = String(sampler)
    }

    this.source_image = String(source_image)
    this.source_mask = String(source_mask)
    this.source_processing = source_processing

    if (source_processing === SourceProcessing.Img2Img) {
      this.denoising_strength = Number(denoising_strength)
    } else {
      this.denoising_strength = Common.Empty
    }

    this.steps = Number(steps)
    this.triggers = [...triggers]
  }
}

export default RerollImageRequest
