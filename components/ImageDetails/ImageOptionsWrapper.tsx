import clsx from 'clsx'
import { Menu, MenuItem, MenuButton, MenuDivider } from '@szhsin/react-menu'
import '@szhsin/react-menu/dist/index.css'
import '@szhsin/react-menu/dist/transitions/slide.css'

import ConfirmationModal from 'components/ConfirmationModal'
import CopyIcon from 'components/icons/CopyIcon'
import DotsVerticalIcon from 'components/icons/DotsVerticalIcon'
import DownloadIcon from 'components/icons/DownloadIcon'
import HeartIcon from 'components/icons/HeartIcon'
import TrashIcon from 'components/icons/TrashIcon'
import { useCallback, useEffect, useState } from 'react'
import {
  deleteCompletedImage,
  deletePendingJobFromDb,
  getImageDetails,
  getParentJobDetails,
  updateCompletedJob
} from 'utils/db'
import { blobToClipboard, downloadFile } from 'utils/imageUtils'

import styles from './imageDetails.module.css'
import AppSettings from 'models/AppSettings'
import PromptInputSettings from 'models/PromptInputSettings'
import {
  copyEditPrompt,
  interrogateImage,
  rerollImage,
  uploadImg2Img,
  uploadInpaint,
  upscaleImage
} from 'controllers/imageDetailsCommon'
import { useRouter } from 'next/navigation'
import WallIcon from 'components/icons/WallIcon'
import ResizeIcon from 'components/icons/ResizeIcon'
import { isiOS, uuidv4 } from 'utils/appUtils'
import { SourceProcessing } from 'utils/promptUtils'
import RefreshIcon from 'components/icons/RefreshIcon'
import { deletePendingJob } from 'controllers/pendingJobsCache'
import { getRelatedImages } from 'components/ImagePage/image.controller'
import { useModal } from '@ebay/nice-modal-react'
import { showErrorToast, showSuccessToast } from 'utils/notificationUtils'
import ShortlinkButton from './ShortlinkButton'
import CreateImageRequest from 'models/CreateImageRequest'

const ImageOptionsWrapper = ({
  handleClose,
  handleDeleteImageClick = () => {},
  handleReloadImageData = () => {},
  imageDetails,
  isModal,
  showTiles,
  setShowTiles,
  handleFullScreen
}: {
  handleClose: () => any
  handleDeleteImageClick?: () => any
  handleReloadImageData?: () => any
  imageDetails: CreateImageRequest
  isModal: boolean
  showTiles: boolean
  setShowTiles: (bool: boolean) => any
  handleFullScreen: () => any
}) => {
  const router = useRouter()
  const confirmationModal = useModal(ConfirmationModal)
  // TODO: FIXME: Blarg!
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // const modal = {
  //   remove: () => false
  // }

  const [favorited, setFavorited] = useState<boolean>(imageDetails.favorited)
  const [pendingReroll, setPendingReroll] = useState(false)
  const [pendingUpscale, setPendingUpscale] = useState(false)
  const [hasParentJob, setHasParentJob] = useState(false)
  const [hasRelatedImages, setHasRelatedImages] = useState(false)
  const [tileSize, setTileSize] = useState('128px')

  const fetchParentJobDetails = useCallback(async () => {
    const details: CreateImageRequest = await getParentJobDetails(
      imageDetails.parentJobId as string
    )

    if (imageDetails.jobId === details.jobId || !imageDetails.parentJobId) {
      setHasParentJob(false)
    } else {
      setHasParentJob(true)
    }
  }, [imageDetails.jobId, imageDetails.parentJobId])

  const handleCopyPromptClick = () => {
    if (AppSettings.get('savePromptOnCreate')) {
      PromptInputSettings.set('prompt', imageDetails.prompt)
    }

    copyEditPrompt(imageDetails)
    router.push(`/create?edit=true`)
    handleClose()
  }

  const handleDeleteImageConfirm = useCallback(async () => {
    handleDeleteImageClick()
    await deletePendingJobFromDb(imageDetails.jobId as string)
    await deleteCompletedImage(imageDetails.jobId as string)
    deletePendingJob(imageDetails.jobId as string)
    getImageDetails.delete(imageDetails.jobId as string) // bust memoization cache
    confirmationModal.remove()
    handleClose()
  }, [
    confirmationModal,
    handleClose,
    handleDeleteImageClick,
    imageDetails.jobId
  ])

  const handleRerollClick = useCallback(
    async (imageDetails: any) => {
      if (pendingReroll) {
        return
      }

      setPendingReroll(true)

      const reRollStatus = await rerollImage(imageDetails)

      const { success } = reRollStatus

      if (success) {
        setPendingReroll(false)
        // router.push('/pending')
        // handleClose()

        showSuccessToast({ message: 'Re-rolling and requesting new image' })
      }
    },
    [pendingReroll]
  )

  const handleTileClick = (size: string) => {
    setTileSize(size)
    setShowTiles(true)
  }

  const handleUpscaleClick = useCallback(async () => {
    if (pendingUpscale) {
      return
    }

    setPendingUpscale(true)

    await upscaleImage(imageDetails)
    router.push('/pending')
    handleClose()
  }, [handleClose, imageDetails, pendingUpscale, router])

  const onDetachParent = useCallback(async () => {
    await updateCompletedJob(
      imageDetails.id,
      Object.assign({}, imageDetails, {
        parentJobId: uuidv4()
      })
    )

    // Bust memoization cache
    getImageDetails.delete(imageDetails.jobId as string)

    handleReloadImageData()
  }, [handleReloadImageData, imageDetails])

  const onFavoriteClick = useCallback(async () => {
    const updateFavorited = !favorited
    setFavorited(updateFavorited)

    await updateCompletedJob(
      imageDetails.id,
      Object.assign({}, imageDetails, {
        favorited: updateFavorited
      })
    )

    // Bust memoization cache
    getImageDetails.delete(imageDetails.jobId as string)
  }, [favorited, imageDetails])

  const checkFavorite = useCallback(async () => {
    const details = await getImageDetails(imageDetails.jobId as string)
    setFavorited(details.favorited)
  }, [imageDetails.jobId])

  const fetchRelatedImages = useCallback(async () => {
    const result = await getRelatedImages(imageDetails.parentJobId as string)

    if (result && result.length > 0) {
      setHasRelatedImages(true)
    }
  }, [imageDetails.parentJobId])

  useEffect(() => {
    fetchRelatedImages()
  }, [fetchRelatedImages, imageDetails.parentJobId])

  useEffect(() => {
    checkFavorite()
  }, [checkFavorite, imageDetails.jobId])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showTiles) {
          e.stopImmediatePropagation()
          e.preventDefault()
          setShowTiles(false)
        }
      }

      if (e.key === 'Backspace') {
        confirmationModal.show({
          onConfirmClick: () => {
            // setShowDeleteModal(false)
            handleDeleteImageConfirm()
          }
        })
      }

      if (e.key === 'Delete') {
        confirmationModal.show({
          onConfirmClick: () => {
            // setShowDeleteModal(false)
            handleDeleteImageConfirm()
          }
        })
      }

      if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
        onFavoriteClick()
      }

      if (e.key === 'd' && !e.ctrlKey && !e.metaKey) {
        downloadFile(imageDetails)
      }

      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        handleRerollClick(imageDetails)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [
    confirmationModal,
    handleClose,
    handleDeleteImageConfirm,
    handleRerollClick,
    imageDetails,
    onFavoriteClick,
    setShowTiles,
    showTiles
  ])

  useEffect(() => {
    fetchParentJobDetails()
  }, [fetchParentJobDetails, imageDetails.parentJobId])

  return (
    <>
      {showTiles && (
        <div
          className="z-[102] fixed top-0 left-0 right-0 bottom-0 bg-repeat"
          onClick={() => setShowTiles(false)}
          style={{
            backgroundImage: `url("data:image/webp;base64,${imageDetails.base64String}")`,
            backgroundSize: tileSize
          }}
        ></div>
      )}
      <div
        id="image-options-wrapper"
        className="flex flex-row justify-center w-full mt-3"
      >
        <div
          id="image-options-buttons"
          className="w-full flex flex-row items-center justify-between tablet:justify-end max-w-[768px] md:gap-4"
        >
          <div className={styles['button-icon']}>
            <Menu
              menuButton={
                <MenuButton>
                  <DotsVerticalIcon />
                </MenuButton>
              }
              transition
              menuClassName={styles['menu']}
            >
              {isModal && (
                <MenuItem
                  className="text-sm"
                  onClick={() => {
                    router.push(`/image/${imageDetails.jobId}`)
                    handleClose()
                  }}
                >
                  View image details page
                </MenuItem>
              )}
              {hasParentJob && (
                <MenuItem className="text-sm" onClick={onDetachParent}>
                  Detach from parent job
                </MenuItem>
              )}
              <MenuItem
                className="text-sm"
                onClick={() => downloadFile(imageDetails)}
              >
                Download image
              </MenuItem>
              <MenuDivider />
              <MenuItem
                className="text-sm"
                onClick={() => {
                  interrogateImage(imageDetails)
                  router.push(`/interrogate?user-share=true`)
                  handleClose()
                }}
              >
                Interrogate (img2text)
              </MenuItem>
              <MenuItem className="text-sm" onClick={handleUpscaleClick}>
                Upscale image {pendingUpscale && ' (processing...)'}
              </MenuItem>
              <MenuDivider />
              <MenuItem
                className="text-sm"
                onClick={() => {
                  uploadImg2Img(imageDetails)
                  router.push(`/create?panel=img2img&edit=true`)
                  handleClose()
                }}
              >
                Use for img2img
              </MenuItem>
              <MenuItem
                className="text-sm"
                onClick={() => {
                  uploadInpaint(imageDetails)
                  router.push(`/create?panel=inpainting&edit=true`)
                  handleClose()
                }}
              >
                Use for inpainting
              </MenuItem>
              {hasRelatedImages && (
                <>
                  <MenuDivider />
                  <MenuItem
                    className="text-sm"
                    onClick={() => {
                      router.push(`/image/${imageDetails.jobId}#related-images`)
                      handleClose()
                    }}
                  >
                    View related images
                  </MenuItem>
                </>
              )}
            </Menu>
          </div>
          <div className={styles['button-icon']}>
            <Menu
              menuButton={
                <MenuButton>
                  <CopyIcon />
                </MenuButton>
              }
              transition
              menuClassName={styles['menu']}
            >
              <MenuItem
                className="text-sm"
                onClick={() => {
                  router.push(
                    `/create?prompt=${encodeURIComponent(imageDetails.prompt)}`
                  )
                  handleClose()
                }}
              >
                Use a prompt from this image
              </MenuItem>
              <MenuItem className="text-sm" onClick={handleCopyPromptClick}>
                Use all settings from this image
              </MenuItem>
              <MenuDivider />
              <MenuItem
                className="text-sm"
                onClick={async () => {
                  if (!imageDetails || !imageDetails.base64String) return

                  const success = await blobToClipboard(
                    imageDetails.base64String
                  )

                  if (success) {
                    showSuccessToast({
                      message: 'Image copied to your clipboard!'
                    })
                  } else {
                    showErrorToast({
                      message: 'Unable to copy image to clipboard.'
                    })
                  }
                }}
              >
                Copy image to clipboard
              </MenuItem>
            </Menu>
          </div>
          {imageDetails.source_processing === SourceProcessing.Prompt && (
            <ShortlinkButton imageDetails={imageDetails} />
          )}
          {imageDetails.tiling && (
            <div className={styles['button-icon']}>
              <Menu
                menuButton={
                  <MenuButton>
                    <WallIcon />
                  </MenuButton>
                }
                transition
                menuClassName={styles['menu']}
              >
                <MenuItem
                  className="text-sm"
                  onClick={() => handleTileClick('64px')}
                >
                  64px tiles
                </MenuItem>
                <MenuItem
                  className="text-sm"
                  onClick={() => handleTileClick('128px')}
                >
                  128px tiles
                </MenuItem>
                <MenuItem
                  className="text-sm"
                  onClick={() => handleTileClick('256px')}
                >
                  256px tiles
                </MenuItem>
                <MenuItem
                  className="text-sm"
                  onClick={() => handleTileClick('512px')}
                >
                  512px tiles
                </MenuItem>
                <MenuItem
                  className="text-sm"
                  onClick={() => handleTileClick('1024px')}
                >
                  1024px tiles
                </MenuItem>
              </Menu>
            </div>
          )}
          {!isiOS() && (
            <div className={styles['button-icon']} onClick={handleFullScreen}>
              <ResizeIcon strokeWidth={1.25} />
            </div>
          )}
          <div
            className={clsx(styles['button-icon'], styles['mobile-hide'])}
            onClick={() => downloadFile(imageDetails)}
          >
            <DownloadIcon />
          </div>
          <div
            className={clsx(styles['button-icon'])}
            onClick={() => handleRerollClick(imageDetails)}
          >
            <RefreshIcon />
          </div>
          <div className={styles['button-icon']} onClick={onFavoriteClick}>
            <HeartIcon fill={favorited ? '#14B8A6' : undefined} />
          </div>
          <div
            className={clsx(styles['button-icon'])}
            onClick={() => {
              confirmationModal.show({
                onConfirmClick: () => {
                  handleDeleteImageConfirm()
                }
              })
            }}
          >
            <TrashIcon />
          </div>
        </div>
      </div>
    </>
  )
}

export default ImageOptionsWrapper
