// @ts-nocheck
import * as exifLib from '@asc0910/exif-library'

export const initBlob = () => {
  if (!Blob.prototype.toPNG) {
    Blob.prototype.toPNG = async function (callback: any) {
      // Converting through canvas will remove exif data
      // So extract exif first, and then add it back when ceating new blob
      const exif = await getExifFromBlob(this)
      return convertBlob(this, 'image/png', callback, exif)
    }
  }

  if (!Blob.prototype.toWebP) {
    Blob.prototype.toWebP = async function (callback: any) {
      const exif = await getExifFromBlob(this)
      return convertBlob(this, 'image/webp', callback, exif)
    }
  }

  if (!Blob.prototype.toJPEG) {
    Blob.prototype.toJPEG = async function (callback: any) {
      const exif = await getExifFromBlob(this)
      return convertBlob(this, 'image/jpeg', callback, exif)
    }
  }

  if (!Blob.prototype.addOrUpdateExifData) {
    Blob.prototype.addOrUpdateExifData = function (userComment: string): Blob {
      return addOrUpdateExifData(this, userComment)
    }
  }
}

function convertBlob(
  blob: Blob | MediaSource,
  type: string,
  callback: (arg0: Blob) => void,
  exif: any = {}
) {
  return new Promise((resolve) => {
    let canvas = <HTMLCanvasElement>createTempCanvas()
    let ctx = canvas.getContext('2d')
    let image = new Image()
    image.src = URL.createObjectURL(blob)
    image.onload = function () {
      canvas.width = image.width
      canvas.height = image.height
      ctx.drawImage(image, 0, 0)
      let result = dataURItoBlob(canvas.toDataURL(type, 1), exif)
      if (callback) callback(result)
      else resolve(result)
    }
  })
}

function createTempCanvas() {
  let canvas = document.createElement('CANVAS')
  canvas.style.display = 'none'
  return canvas
}

function dataURItoBlob(dataURI: string, exif: any) {
  var byteString = atob(dataURI.split(',')[1])
  var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
  byteString = byteStringWithExifData(dataURI, byteString, exif) // insert exif data

  var ab = new ArrayBuffer(byteString.length)
  var ia = new Uint8Array(ab)
  for (var i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }

  var blob = new Blob([ab], { type: mimeString })
  return blob
}

function getExifFromDataURI(dataURI: string): any {
  let existing_exif = {}
  try {
    existing_exif = exifLib.load(dataURI)
  } catch (e) {}
  return existing_exif
}

async function getExifFromBlob(blob: Blob) {
  const dataURI = await blobToBase64(blob)
  return getExifFromDataURI(dataURI)
}

function mergeExifData(existing_exif: any, userComment: string): any {
  // 0th IFD
  const zeroth = {
    [exifLib.TagNumbers.ImageIFD.Software]:
      'ArtBot - Create images with Stable Diffusion, utilizing the AI Horde'
  }
  // exif IFD
  const exif = userComment
    ? {
        [exifLib.TagNumbers.ExifIFD.UserComment]: `ASCII\0\0\0${userComment}`
      }
    : {}
  // exif main obj
  const exifObj = {
    ...existing_exif,
    '0th': existing_exif['0th']
      ? { ...existing_exif['0th'], ...zeroth }
      : zeroth,
    Exif: existing_exif.Exif ? { ...existing_exif.Exif, ...exif } : exif
  }
  return exifObj
}

function byteStringWithExifData(
  dataURI: string,
  byteString: string,
  exif: any
): string {
  const exifbytes = exifLib.dump(exif)
  byteString = exifLib.insert(exifbytes, byteString)
  return byteString
}

async function addOrUpdateExifData(blob: Blob, userComment: string): Blob {
  const dataURI = await blobToBase64(blob)
  let existing_exif = getExifFromDataURI(dataURI)
  let new_efix = mergeExifData(existing_exif, userComment)
  const newBlob = dataURItoBlob(dataURI, new_efix)
  return newBlob
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = function () {
      if (reader.result) {
        resolve(reader.result as string)
      } else {
        const err = new Error('Failed to convert blob to base64')
        console.error(err)
        reject(err)
      }
    }
    reader.onerror = function (error) {
      reject(error)
    }
    reader.readAsDataURL(blob)
  })
}
