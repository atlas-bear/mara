import { useState, useEffect } from "react";

const defaultBranding = {
  logo: "/client-logo.svg",
  companyName: "Client Name",
  colors: {
    primary: "#234567",
    secondary: "#890123",
  },
};

export function useBranding() {
  const [branding, setBranding] = useState(defaultBranding);

  useEffect(() => {
    // This can be fetched from an API or environment variables
    setBranding({
      logo: import.meta.env.VITE_CLIENT_LOGO || defaultBranding.logo,
      companyName:
        import.meta.env.VITE_CLIENT_NAME || defaultBranding.companyName,
      colors: {
        primary:
          import.meta.env.VITE_CLIENT_PRIMARY_COLOR ||
          defaultBranding.colors.primary,
        secondary:
          import.meta.env.VITE_CLIENT_SECONDARY_COLOR ||
          defaultBranding.colors.secondary,
      },
    });
  }, []);

  return { branding };
}
