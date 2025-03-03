export const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    maxWidth: '800px',
    margin: '0 auto',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  header: {
    backgroundColor: '#FFF7ED', // orange-50
    padding: '24px',
    borderBottom: '1px solid #FFEDD5', // orange-100
    borderTopLeftRadius: '8px', 
    borderTopRightRadius: '8px',
  },
  headerFlex: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logo: {
    maxWidth: '150px',
    height: 'auto',
    marginBottom: '15px',
  },
  badgeContainer: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px',
  },
  alertBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    backgroundColor: '#FEE2E2', // red-100
    borderRadius: '9999px', // rounded-full
    color: '#991B1B', // red-800
    fontSize: '14px',
    fontWeight: 'bold',
  },
  typeBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    backgroundColor: '#FEF3C7', // amber-100
    borderRadius: '9999px', // rounded-full
    color: '#92400E', // amber-800
    fontSize: '14px',
    fontWeight: 'bold',
  },
  vesselName: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginTop: '8px',
    marginBottom: '4px',
    color: '#111827', // gray-900
  },
  vesselInfo: {
    fontSize: '14px',
    color: '#4B5563', // gray-600
    margin: '0',
  },
  dateContainer: {
    textAlign: 'right',
  },
  dateLabel: {
    fontSize: '14px',
    color: '#6B7280', // gray-500
    margin: '0 0 4px 0',
  },
  dateValue: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827', // gray-900
    margin: '0',
  },
  quickFactsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    padding: '24px',
    borderBottom: '1px solid #E5E7EB', // gray-200
  },
  factColumn: {
    flex: '1 1 30%',
    minWidth: '200px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },
  factIcon: {
    width: '20px',
    height: '20px',
    marginTop: '4px',
    // We'll use text and emoji for email compatibility
  },
  factContent: {
    flex: '1',
  },
  factLabel: {
    fontSize: '14px',
    color: '#6B7280', // gray-500
    margin: '0 0 4px 0',
  },
  factValue: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827', // gray-900
    margin: '0 0 4px 0',
  },
  factSubtext: {
    fontSize: '14px',
    color: '#6B7280', // gray-500
    margin: '0',
  },
  mapSection: {
    padding: '24px',
    borderBottom: '1px solid #E5E7EB', // gray-200
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827', // gray-900
    marginTop: '0',
    marginBottom: '16px',
  },
  mapImage: {
    width: '100%',
    borderRadius: '4px',
    border: '1px solid #E5E7EB', // gray-200
  },
  mapLegend: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#6B7280', // gray-500
    display: 'flex',
    alignItems: 'center',
  },
  legendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#EF4444', // red-500
    display: 'inline-block',
    marginRight: '5px',
  },
  detailsSection: {
    padding: '24px',
    borderBottom: '1px solid #E5E7EB', // gray-200
  },
  contentBoxes: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  contentBox: {
    backgroundColor: '#F9FAFB', // gray-50
    padding: '16px',
    borderRadius: '6px',
  },
  contentTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginTop: '0',
    marginBottom: '8px',
    color: '#111827', // gray-900
  },
  contentText: {
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#374151', // gray-700
    margin: '0',
  },
  contentList: {
    margin: '0',
    paddingLeft: '24px',
  },
  listItem: {
    margin: '4px 0',
    color: '#374151', // gray-700
    fontSize: '14px',
    lineHeight: '1.5',
  },
  analysisSection: {
    padding: '24px',
  },
  keyFindings: {
    backgroundColor: '#FFF7ED', // orange-50
    padding: '16px',
    borderRadius: '6px',
  },
  recommendations: {
    backgroundColor: '#F0F9FF', // blue-50
    padding: '16px',
    borderRadius: '6px',
    marginTop: '24px',
  },
  footer: {
    marginTop: '30px',
    paddingTop: '20px',
    borderTop: '1px solid #E5E7EB', // gray-200
    textAlign: 'center',
    color: '#6B7280', // gray-500
    fontSize: '12px',
    padding: '0 24px 24px',
  },
  footerText: {
    margin: '4px 0',
  },
};