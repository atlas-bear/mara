![MARA Logo](https://drive.google.com/uc?id=1OB5Lwgpp03DB9vs50T_kkKzL5VV_y5Eo)

Welcome to the official repository for MARA (Multi-source Analysis and Reporting Architecture), the integrated intelligence platform by Atlas|Bear. This repository holds core files, scripts, and other essential components for the application.

## Overview of MARA by Atlas|Bear

MARA is a powerful platform designed to provide comprehensive insights into maritime- and other security-related incidents worldwide. This introduction will provide you with an overview of MARA's core features, its purpose, and its primary objectives.

### Purpose and Objectives

#### Purpose

MARA was created to address the critical need for a centralized and reliable source of information related to maritime and other types of security-related incidents. In an increasingly interconnected world, the safety and security of maritime activities are of paramount importance. MARA aims to enhance situational awareness, support decision-making processes, and enable stakeholders to proactively respond to incidents.

#### Objectives

1. **Comprehensive Incident Monitoring**: MARA offers an extensive database of maritime and security incidents, ensuring that users have access to real-time data for informed decision-making.
2. **Strategic Intelligence Collection**: Our platform aggregates strategic intelligence from various sources, providing valuable insights into specific regions and domains, including maritime, cyber, critical minerals, and more.
3. **Priority Intelligence Requirements (PIRs)**: MARA helps users create and manage Priority Intelligence Requirements, enabling focused analysis and notifications on critical topics.
4. **The 3R Framework (Routes, Resources, Relations)**: We integrate the 3R framework to allow for a holistic understanding of incidents and their implications on global security.
5. **Efficient Data Entry**: MARA simplifies the process of adding content to the platform, ensuring that users can contribute their findings and expertise to enhance the collective knowledge base.
6. **Standard Operating Procedures (SOPs)**: We follow rigorous SOPs to maintain data accuracy, integrity, and security, ensuring the trustworthiness of the information presented.

Atlas|Bear is committed to providing a cutting-edge platform for all users, from analysts and decision-makers to organizations concerned with maritime and security affairs. We are dedicated to continuously improving MARA and supporting its users in their mission to protect and secure global interests.

## Repository Structure

- **/src**
  - **/apps**
    - **/mara**: Main application containing both weekly and flash reports
  - **/shared**: Shared utilities and components used across the application
- **/functions**: Netlify serverless functions for backend operations
  - **Collection Functions**: Source-specific data collectors (RECAAP, UKMTO, MDAT, ICC)
  - **Processing Functions**: Data normalization and incident creation
  - **Deduplication System**: Cross-source duplicate detection and merging
  - **Flash Report System**: Email notification generation and delivery
- **/scripts**: Automation and utility scripts
- **/data**: Sample data and datasets used for development and testing
- **/docs**: VitePress-based documentation site
  - **guide/**: Getting started and architecture guides
  - **data-pipeline/**: Data collection and processing documentation
  - **deduplication/**: Cross-source deduplication system documentation
  - **flash-report/**: Flash Report system documentation
  - **weekly-report/**: Weekly Report system documentation
  - **components/**: Reusable component documentation

## Technical Architecture

For a detailed understanding of MARA's technical architecture, including component structure, routing, and key features, please refer to our [Architecture Documentation](docs/guide/architecture.md).

### Data Pipeline

MARA features a comprehensive data pipeline that automates the collection, deduplication, and processing of maritime incident data:

1. **Collection**: Dedicated functions collect data from authoritative maritime sources (RECAAP, UKMTO, MDAT, ICC)
2. **Deduplication**: The cross-source deduplication system identifies and merges duplicate reports from different sources
3. **Processing**: Raw data is transformed into structured incident records with AI-enhanced analysis
4. **Reporting**: Processed incidents power Flash Reports and Weekly Reports for timely maritime security intelligence

This automated pipeline ensures comprehensive coverage, high data quality, and timely reporting of maritime security incidents worldwide.

## Contributing

We welcome contributions from the community. Please read our [contributing guidelines](CONTRIBUTING.md) for more information.

## Proprietary Notice

This software and its associated documentation files (the "Software") are proprietary and confidential to Atlas|Bear. Unauthorized copying of this file, via any medium, is strictly prohibited. This software may not be used, copied, modified, or distributed except with the express written permission of Atlas|Bear.

## Internal Licensing Agreement

This project is proprietary and confidential to Atlas|Bear. For more details, please refer to the [Internal Licensing Agreement](INTERNAL_LICENSE.md).

## Contact

For any inquiries or support, please contact us at mara@atlasbear.co.

[![Netlify Status](https://api.netlify.com/api/v1/badges/edfdfb3b-fd14-477a-9f78-a1466953c44a/deploy-status)](https://app.netlify.com/sites/mara-v2/deploys)
