import { ExecutiveBrief as MaraExecutiveBrief } from '@shared/components/ExecutiveBrief'

export function CustomExecutiveBrief({ ...props }) {
  return (
    <div className="client-custom-wrapper">
      <MaraExecutiveBrief {...props} />
      {/* Add any client-specific additions here */}
    </div>
  )
}