import SpinnerV2 from 'components/Spinner'
import { Button } from 'app/_components/Button'
import Section from 'app/_components/Section'
import SubSectionTitle from 'app/_components/SubSectionTitle'
import { useState } from 'react'
import { downloadBlob, formatDate } from 'utils/appUtils'
import { dbExport } from 'utils/db'
import { showSuccessToast } from 'utils/notificationUtils'

export default function ExportDatabase() {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [totalRows, setTotalRows] = useState(0)

  return (
    <Section>
      <SubSectionTitle>
        <strong>Export browser database</strong>
        <div className="block w-full mt-2 mb-2 text-xs font-[400]">
          Downloads raw ArtBot database stored within your browser as a large
          JSON file.
        </div>
        {loading && totalRows > 0 && (
          <div className="flex flex-row w-full mb-2 text-xs items-center gap-2">
            <SpinnerV2 size={18} />
            Processing {progress} of {totalRows} rows...
          </div>
        )}
      </SubSectionTitle>
      <div className="flex flex-row">
        <Button
          onClick={async () => {
            //@ts-ignore
            function progressCallback({ completedRows, totalRows }) {
              setProgress(completedRows)
              setTotalRows(totalRows)
            }

            setLoading(true)
            //@ts-ignore
            const blob = await dbExport(progressCallback)
            downloadBlob(blob, `artbot-db_${formatDate()}.json`)
            showSuccessToast({ message: 'ArtBot database downloaded!' })

            setLoading(false)
          }}
        >
          Download database
        </Button>
      </div>
    </Section>
  )
}
