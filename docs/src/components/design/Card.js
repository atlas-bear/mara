import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import styles from './Card.module.css';

export default function Card({
  className,
  title,
  description,
  to,
  icon: Icon,
}) {
  return (
    <div className={clsx('card', styles.card, className)}>
      <div className="card__body">
        {Icon && <Icon className={styles.cardIcon} size="2rem" />}
        <h3 className={styles.cardTitle}>{title}</h3>
        <p className={styles.cardDescription}>{description}</p>
      </div>
      {to && (
        <div className="card__footer">
          <Link className="button button--primary button--block" to={to}>
            Learn More
          </Link>
        </div>
      )}
    </div>
  );
}
