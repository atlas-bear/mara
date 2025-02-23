import { ExecutiveBrief } from '@shared/components/ExecutiveBrief'
import { RegionalBrief } from '@shared/components/RegionalBrief'
import { IncidentDetails } from '@shared/components/IncidentDetails'
import { MaritimeMap } from '@shared/components/MaritimeMap'

export default function WeeklyReport() {
  return (
    <div className="space-y-8">
      <ExecutiveBrief />
      <RegionalBrief />
      <IncidentDetails />
    </div>
  )
}