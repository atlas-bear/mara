import { ExecutiveBrief, RegionalBrief, IncidentDetails } from '@mara/components'

export default function WeeklyReport() {
  return (
    <div className="space-y-8">
      <ExecutiveBrief />
      <RegionalBrief />
      <IncidentDetails />
    </div>
  )
}