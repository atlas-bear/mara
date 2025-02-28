import { Outlet, useParams } from 'react-router-dom';
import { useBranding } from '@client/hooks/useBranding'
import PDFDownloadButton from '@shared/components/PDFDownloadButton';

export default function MainLayout() {
  const { branding } = useBranding()
  const params = useParams(); // Get route parameters

  console.log("🚀 MainLayout mounted!");
  console.log("Params received:", params); // Debugging output
  
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <img 
              src={branding.logo} 
              alt={branding.companyName} 
              className="h-8"
            />
            <PDFDownloadButton 
              variant="primary"
            />
          </div>
        </div>
      </header>
      
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}