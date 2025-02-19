'use client'
/* eslint-disable jsx-a11y/alt-text */
/* eslint-disable @next/next/no-img-element */
import Editor from 'app/_modules/Editor'
import PageTitle from 'app/_components/PageTitle'
import { useCallback, useEffect, useReducer, useState } from 'react'
import DefaultPromptInput from 'models/DefaultPromptInput'
import { useFetchImage } from 'hooks/useFetchImage'
import SpinnerV2 from 'components/Spinner'
import { LivePaintOptions } from './LivePaintPage/Options'
import { SourceProcessing } from 'utils/promptUtils'
import { useEffectOnce } from 'hooks/useEffectOnce'
import { Button } from 'app/_components/Button'
import DownloadIcon from 'components/icons/DownloadIcon'
import { downloadFile, nearestWholeMultiple } from 'utils/imageUtils'
import { trackEvent } from 'api/telemetry'
import BrushIcon from 'components/icons/BrushIcon'
import PhotoIcon from 'components/icons/PhotoIcon'
import PointIcon from 'components/icons/PointIcon'
import { useStore } from 'statery'
import { userInfoStore } from 'store/userStore'
import Linker from 'components/UI/Linker'
import { clearCanvasStore } from 'store/canvasStore'
import styles from './livePaint.module.css'
const TWO_COLUMN_SIZE = 789

const removeImageCanvasData = {
  canvasData: null,
  maskData: null,
  imageType: '',
  source_image: '',
  source_mask: '',
  source_processing: SourceProcessing.Prompt
}

const LivePaint = () => {
  const initInput: DefaultPromptInput = {
    ...new DefaultPromptInput(),
    source_processing: SourceProcessing.Img2Img,
    sampler: 'k_dpm_2'
  }

  const userState = useStore(userInfoStore)
  const { loggedIn } = userState

  const [newResult, setNewResult] = useState(false)
  const [pageWidth, setPageWidth] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [isSinglePanel, setIsSinglePanel] = useState(false)

  const [input, setInput] = useReducer((state: any, newState: any) => {
    const updatedInputState = { ...state, ...newState }

    return updatedInputState
  }, initInput)

  let [imageResult, pending, jobStatus, waitTime] = useFetchImage(input)

  const getCanvasSize = useCallback(() => {
    let size = pageWidth
    if (!isSinglePanel) {
      size = Math.floor((pageWidth - 8) / 2)

      // Ensure size is multiple of 64
      let validateSize = nearestWholeMultiple(size)

      if (validateSize > size) {
        size = validateSize - 64
      } else {
        size = validateSize
      }
    }

    return size
  }, [isSinglePanel, pageWidth])

  useEffect(() => {
    if (pageWidth !== 0) {
      setInput({
        width: getCanvasSize(),
        height: getCanvasSize()
      })
    }
  }, [getCanvasSize, pageWidth])

  useEffect(() => {
    if (imageResult) {
      setNewResult(true)
    }
  }, [imageResult])

  useEffectOnce(() => {
    setInput({ seed: String(Math.abs((Math.random() * 2 ** 32) | 0)) })

    const container = document.getElementById('live-paint-container')
    const width = container?.offsetWidth
    // @ts-ignore
    setPageWidth(width)

    // @ts-ignore
    if (width < TWO_COLUMN_SIZE) {
      setIsSinglePanel(true)
    }

    trackEvent({
      event: 'PAGE_VIEW',
      context: '/pages/live-paint'
    })
  })

  let size = getCanvasSize()

  return (
    <>
      <PageTitle>Live Paint</PageTitle>
      {!loggedIn && (
        <div className="text-amber-500">
          <strong>Important!</strong> You should{' '}
          <Linker href={'/settings'}>log in</Linker> with your Stable Horde API
          key, as image processing will go <em>much</em> faster!
        </div>
      )}
      <div
        className="flex flex-row justify-center w-full"
        id="live-paint-container"
        style={{
          columnGap: isSinglePanel ? '0' : '8px',
          paddingTop: '60px'
        }}
      >
        <div
          style={{
            maxWidth: `${size}px`,
            width: isSinglePanel ? '100%' : '50%'
          }}
        >
          {pageWidth > 0 && (
            <Editor
              canvasId="drawing-canvas"
              canvasType="drawing"
              handleRemoveClick={() => {
                clearCanvasStore()
                setInput({
                  ...removeImageCanvasData
                })
              }}
              hideCanvas={showResult}
              setInput={setInput}
              canvasHeight={size}
              canvasWidth={size}
              editorClassName="relative mt-[67px]"
              toolbarClassName={styles.LivePaintToolbar}
              toolbarAbsolute
              toolbarDisableMenu
            />
          )}
        </div>
        <div
          className="flex flex-col"
          style={{
            maxWidth: `${size}px`,
            width: isSinglePanel ? '100%' : '50%'
          }}
        >
          {/**
           * This empty div is a placeholder to maintain valid heights
           */}
          <div className="h-[51px] mb-[16px] flex flex-row justify-end w-full items-center gap-2 text-xs"></div>
          {((isSinglePanel && showResult) || !isSinglePanel) && imageResult && (
            <img
              style={{
                height: `${size}px`,
                width: `${size}px`,
                maxWidth: `${size}px`
              }}
              src={'data:image/webp;base64,' + imageResult}
            />
          )}
          {((isSinglePanel && showResult) || !isSinglePanel) &&
            !imageResult && (
              <div
                className="flex flex-col items-center justify-center text-black bg-white"
                style={{
                  height: `${size}px`,
                  width: `${size}px`
                }}
              >
                {isSinglePanel &&
                  !input.source_image &&
                  !pending &&
                  `Hey, paint something on the canvas!`}
                {!isSinglePanel &&
                  !input.source_image &&
                  !pending &&
                  `<-- Hey, paint something over there!`}
                {input.source_image &&
                  !input.prompt &&
                  !pending &&
                  `Hey, don't forget to write a prompt down below!`}
                {!imageResult && pending && `Requesting new image...`}
              </div>
            )}
        </div>
      </div>
      <div className="flex flex-row items-center justify-between w-full mt-2">
        <div className="flex flex-row items-center gap-2 text-sm adCol:text-md">
          {pending ? <SpinnerV2 size={20} /> : ''}
          {pending ? <span>{jobStatus}</span> : ''}
          {pending && waitTime !== '...' ? (
            <span>(~{Number(waitTime) + 3} seconds remaining)</span>
          ) : (
            ''
          )}
        </div>
        <div className="flex flex-row justify-end gap-2">
          <Button
            disabled={!input.prompt || !input.source_image || !imageResult}
            onClick={async () => {
              await downloadFile({
                base64String: input.source_image,
                fileType: 'image/webp',
                prompt: 'drawing_input_' + input.prompt
              })

              await downloadFile({
                base64String: imageResult,
                fileType: 'image/webp',
                prompt: 'image_output_' + input.prompt
              })
            }}
          >
            <DownloadIcon />
            Download
          </Button>
          {isSinglePanel && (
            <Button
              className="relative"
              // disabled={!input.prompt || !input.source_image || !imageResult}
              onClick={() => {
                if (!showResult) {
                  setNewResult(false)
                }

                setShowResult(!showResult)
              }}
            >
              {newResult && (
                <PointIcon
                  // className={styles.WorkerStatus}
                  fill={'red'}
                  stroke="white"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0
                  }}
                />
              )}
              {showResult && (
                <>
                  <>
                    <BrushIcon />
                    View canvas
                  </>
                </>
              )}
              {!showResult && (
                <>
                  <PhotoIcon />
                  View result
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      <div className="flex w-full gap-2 mt-2 max-w-[576px]">
        <LivePaintOptions input={input} setInput={setInput} />
      </div>
    </>
  )
}

export default LivePaint
