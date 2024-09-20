'use client'
import { useState, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { FileIcon, UploadIcon, CheckCircleIcon } from 'lucide-react'
import { saveAs } from 'file-saver'
import axios from 'axios'

export default function ConvertisseurPdf() {
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [convertedFile, setConvertedFile] = useState(null)
  const [error, setError] = useState('')

  const handleFileChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0])
      setError('')
    }
  }

  const handleDragEnter = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
      setError('')
    }
  }, [])

  const handleConvert = async () => {
    if (!file) {
      setError('Please select a PDF file.')
      return
    }
    setError('')
    setIsConverting(true)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await axios.post('/api/parse-pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        responseType: 'blob',
      })
      
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      setConvertedFile(blob)
      setIsSuccess(true)
    } catch (err) {
      setError('Error converting PDF to DOCX.')
    } finally {
      setIsConverting(false)
    }
  }

  const handleDownload = () => {
    if (convertedFile) {
      saveAs(convertedFile, file.name.replace('.pdf', '.docx'))
    }
  }

  const handleReset = () => {
    setFile(null)
    setIsSuccess(false)
    setConvertedFile(null)
    setError('')
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-8 text-center">
          <CheckCircleIcon className="h-24 w-24 text-green-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Conversion Terminée !</h2>
          <p className="text-gray-600 mb-6">Votre PDF a été converti avec succès. C'est le moment de célébrer !</p>
          <Button onClick={handleDownload} className="w-full mb-4">Télécharger le DOCX</Button>
          <Button onClick={handleReset} className="w-full">Convertir un autre PDF</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-3xl">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-8">
          Convertisseur PDF → DOCX
        </h1>
        {isConverting ? (
          <div className="bg-white rounded-lg shadow-xl p-8 text-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative w-24 h-24">
                <img src="/penguin.svg" alt="" className='sliding' />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Conversion en cours...</h2>
              <p className="text-gray-600">Regardez le pingouin glisser pendant que nous travaillons !</p>
              <div className="w-full max-w-xs bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div className="bg-primary h-2.5 rounded-full animate-[grow_3s_ease-in-out_infinite]"></div>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`bg-white border-2 border-dashed rounded-lg shadow-xl p-8 text-center ${isDragging ? 'border-primary' : 'border-gray-300'}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}>
            <div className="flex flex-col items-center space-y-6">
              {file ? (
                <FileIcon className="h-24 w-24 text-primary" />
              ) : (
                <UploadIcon className="h-24 w-24 text-gray-400" />
              )}
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf"
                className="hidden"
                id="file-upload" />
              <label
                htmlFor="file-upload"
                className="bg-primary text-white font-semibold py-2 px-4 rounded cursor-pointer hover:bg-primary/90 transition duration-200">
                Choisir un fichier PDF
              </label>
              {file ? (
                <p className="text-sm text-gray-600">Fichier sélectionné : {file.name}</p>
              ) : (
                <p className="text-sm text-gray-600">ou glissez-déposez un fichier PDF ici</p>
              )}
            </div>
          </div>
        )}
        {file && !isConverting && (
          <div className="mt-6 text-center">
            <Button onClick={handleConvert} className="w-full max-w-xs">
              Convertir le PDF
            </Button>
          </div>
        )}
        {error && <p className="mt-4 text-center text-red-500">{error}</p>}
      </div>
    </div>
  )
}