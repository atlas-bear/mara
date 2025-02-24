import { Outlet, useParams } from 'react-router-dom';
import { useBranding } from '@client/hooks/useBranding'

export default function MainLayout() {
  const { branding } = useBranding()
  const params = useParams(); // Get route parameters

  console.log("🚀 MainLayout mounted!");
  console.log("Params received:", params); // Debugging output
  
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <img 
            src={branding.logo} 
            alt={branding.companyName} 
            className="h-8"
          />
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