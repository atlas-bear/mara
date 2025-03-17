import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Card from '../components/design/Card';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className="container">
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <h1 className={styles.heroTitle}>MARA Documentation</h1>
            <p className={styles.heroSubtitle}>
              Multi-source Analysis and Reporting Architecture for monitoring security-related incidents
            </p>
            <div className={styles.buttons}>
              <Link
                className="button button--primary button--lg"
                to="/getting-started">
                Get Started
              </Link>
              <Link
                className="button button--secondary button--lg"
                to="/api">
                API Reference
              </Link>
            </div>
          </div>
          <div className={styles.heroImage}>
            <img src="/img/hero-illustration.svg" alt="MARA illustration" />
          </div>
        </div>
      </div>
    </header>
  );
}

function FeatureCard({title, description, to}) {
  return (
    <div className={clsx('col col--4')}>
      <Card
        title={title}
        description={description}
        to={to}
      />
    </div>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="Home"
      description="Multi-source Analysis and Reporting Architecture for monitoring security-related incidents">
      <HomepageHeader />
      <main>
        <section className={styles.features}>
          <div className="container">
            <div className="row">
              <FeatureCard
                title="Comprehensive Documentation"
                description="Learn how to install, configure, and use MARA with our detailed guides and tutorials."
                to="/getting-started"
              />
              <FeatureCard
                title="API Reference"
                description="Integrate with MARA's powerful API to access security incident data, reports, and analytics."
                to="/api"
              />
              <FeatureCard
                title="Use Cases"
                description="Discover how organizations use MARA to enhance maritime security and risk management."
                to="/use-cases"
              />
            </div>
          </div>
        </section>
        
        <section className={styles.useCaseSection}>
          <div className="container">
            <div className={styles.useCaseHeader}>
              <h2>Trusted by Security Professionals Worldwide</h2>
              <p>MARA provides critical intelligence and analysis for maritime security operations</p>
            </div>
            <div className={styles.useCaseGrid}>
              <div className={styles.useCaseItem}>
                <h3>Real-time Incident Tracking</h3>
                <p>Monitor security incidents as they happen with automated alerts and updates</p>
              </div>
              <div className={styles.useCaseItem}>
                <h3>Risk Assessment</h3>
                <p>Utilize comprehensive risk indices for countries and ports to inform decision-making</p>
              </div>
              <div className={styles.useCaseItem}>
                <h3>Intelligence Reports</h3>
                <p>Access detailed analysis and reports from security experts around the globe</p>
              </div>
              <div className={styles.useCaseItem}>
                <h3>Data Visualization</h3>
                <p>View incident hotspots and trends through intuitive, interactive maps</p>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.ctaSection}>
          <div className="container">
            <div className={styles.ctaContent}>
              <h2>Ready to enhance your maritime security operations?</h2>
              <p>Get started with MARA today and gain access to our comprehensive security intelligence platform.</p>
              <div className={styles.ctaButtons}>
                <Link
                  className="button button--primary button--lg"
                  to="/getting-started">
                  Get Started
                </Link>
                <Link
                  className="button button--secondary button--lg"
                  to="/contact">
                  Contact Us
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
