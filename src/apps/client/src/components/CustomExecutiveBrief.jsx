import { ExecutiveBrief as MaraExecutiveBrief } from '@mara/components'

export function CustomExecutiveBrief({ ...props }) {
  return (
    <div className="client-custom-wrapper">
      <MaraExecutiveBrief {...props} />
      {/* Add any client-specific additions here */}
    </div>
  )
}