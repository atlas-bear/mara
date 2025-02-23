import { ExecutiveBrief } from '@components/WeeklyReport/ExecutiveBrief'
import { RegionalBrief } from '@components/WeeklyReport/RegionalBrief'
import { IncidentDetails } from '@components/WeeklyReport/IncidentDetails'
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