import React from 'react';
import { styles } from './styles';
import { formatCoordinates } from '@shared/features/weekly-report';

// Email-safe template (static HTML with inline styles)
const EmailTemplate = ({ incident, branding }) => {
  // Extract data from incident (assuming similar structure to weekly report)
  const incidentData = incident.incident?.fields || incident;
  const vesselData = incident.vessel?.fields || {};
  const incidentVesselData = incident.incidentVessel?.fields || {};
  const incidentTypeData = incident.incidentType?.fields || {};

  // Get map image URL
  const mapImageUrl = incident.mapImageUrl || 'https://placehold.co/600x400?text=Map+Loading...';

  // Use branding if provided, otherwise use defaults
  const primaryColor = branding?.colors?.primary || '#234567';
  const secondaryColor = branding?.colors?.secondary || '#890123';
  const logo = branding?.logo || '/default-logo.png';
  const companyName = branding?.companyName || 'Maritime Risk Analysis';

  return (
    <div style={styles.container}>
      {/* Header with Alert Status */}
      <div style={styles.header}>
        <img src={logo} alt={companyName} style={styles.logo} />
        
        <div style={styles.headerFlex}>
          <div>
            <div style={styles.badgeContainer}>
              <span style={styles.alertBadge}>Alert ID: {incidentData.id}</span>
              <span style={styles.typeBadge}>{incidentTypeData.name || incidentData.type}</span>
            </div>
            <h1 style={{...styles.vesselName, color: primaryColor}}>
              {vesselData.name || incidentData.vesselName || 'Unknown Vessel'}
            </h1>
            <p style={styles.vesselInfo}>
              {vesselData.type || incidentData.vesselType} | 
              IMO: {vesselData.imo || incidentData.vesselIMO} | 
              Flag: {vesselData.flag || incidentData.vesselFlag}
            </p>
          </div>
          <div style={styles.dateContainer}>
            <p style={styles.dateLabel}>Reported</p>
            <p style={styles.dateValue}>
              {new Date(incidentData.date_time_utc || incidentData.date).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Facts Grid */}
      <div style={styles.quickFactsGrid}>
        <div style={styles.factColumn}>
          <div style={styles.factIcon}>📍</div>
          <div style={styles.factContent}>
            <p style={styles.factLabel}>Location</p>
            <p style={styles.factValue}>{incidentData.location_name || incidentData.location}</p>
            <p style={styles.factSubtext}>
              {incidentData.coordinates ? 
                `${formatCoordinates(incidentData.coordinates.latitude, true)}, ${formatCoordinates(incidentData.coordinates.longitude, false)}` :
                `${formatCoordinates(incidentData.latitude, true)}, ${formatCoordinates(incidentData.longitude, false)}`
              }
            </p>
          </div>
        </div>

        <div style={styles.factColumn}>
          <div style={styles.factIcon}>🚢</div>
          <div style={styles.factContent}>
            <p style={styles.factLabel}>Vessel Status</p>
            <p style={styles.factValue}>{incidentVesselData.vessel_status_during_incident || incidentData.status || 'Unknown'}</p>
            <p style={styles.factSubtext}>En route to {incidentData.destination || 'destination'}</p>
          </div>
        </div>

        <div style={styles.factColumn}>
          <div style={styles.factIcon}>👥</div>
          <div style={styles.factContent}>
            <p style={styles.factLabel}>Crew Status</p>
            <p style={styles.factValue}>{incidentVesselData.crew_impact || incidentData.crewStatus || 'No injuries reported'}</p>
          </div>
        </div>
      </div>

      {/* Incident Map */}
      <div style={styles.mapSection}>
        <h2 style={{...styles.sectionTitle, color: primaryColor}}>Location</h2>
        <img 
          src={mapImageUrl} 
          alt="Incident Location Map" 
          style={styles.mapImage} 
        />
        <div style={styles.mapLegend}>
          <span style={{...styles.legendDot, backgroundColor: secondaryColor}}></span>
          <span>Incident Location</span>
        </div>
      </div>

      {/* Incident Details */}
      <div style={styles.detailsSection}>
        <h2 style={{...styles.sectionTitle, color: primaryColor}}>Incident Details</h2>
        <div style={styles.contentBoxes}>
          <div style={styles.contentBox}>
            <h3 style={styles.contentTitle}>Description</h3>
            <p style={styles.contentText}>{incidentData.description}</p>
          </div>

          {(incidentData.response_type || incidentData.response_type_names || incidentData.responseActions) && (
            <div style={styles.contentBox}>
              <h3 style={styles.contentTitle}>Response Actions</h3>
              <ul style={styles.contentList}>
                {(incidentData.response_type_names || incidentData.response_type || incidentData.responseActions || []).map((action, index) => (
                  <li key={index} style={styles.listItem}>{action}</li>
                ))}
                {(incidentData.authorities_notified_names || incidentData.authorities_notified || []).map((authority, index) => (
                  <li key={`auth-${index}`} style={styles.listItem}>{authority}</li>
                ))}
              </ul>
            </div>
          )}

          {(incidentData.items_stolen || incidentData.items_stolen_names) && (
            <div style={styles.contentBox}>
              <h3 style={styles.contentTitle}>Stolen Items</h3>
              <ul style={styles.contentList}>
                {(incidentData.items_stolen_names || incidentData.items_stolen || []).map((item, index) => (
                  <li key={index} style={styles.listItem}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Analysis Section */}
      <div style={styles.analysisSection}>
        <h2 style={{...styles.sectionTitle, color: primaryColor}}>Analysis</h2>
        
        <div style={{...styles.keyFindings, borderLeft: `4px solid ${secondaryColor}`}}>
          <h3 style={styles.contentTitle}>Key Findings</h3>
          {Array.isArray(incidentData.analysis) ? (
            <ul style={styles.contentList}>
              {incidentData.analysis.map((point, index) => (
                <li key={index} style={styles.listItem}>{point}</li>
              ))}
            </ul>
          ) : (
            <p style={styles.contentText}>{incidentData.analysis}</p>
          )}
        </div>

        {incidentData.recommendations && (
          <div style={{...styles.recommendations, borderLeft: `4px solid ${primaryColor}`}}>
            <h3 style={styles.contentTitle}>Recommendations</h3>
            <p style={styles.contentText}>{incidentData.recommendations}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <p style={styles.footerText}>© {new Date().getFullYear()} {companyName}. All rights reserved.</p>
        <p style={styles.footerText}>This alert is confidential and for the intended recipient only.</p>
      </div>
    </div>
  );
};

export default EmailTemplate;