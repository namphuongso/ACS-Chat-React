import React, { SVGProps } from 'react';

export const PinIcon: React.FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="12" y1="17" x2="12" y2="22"></line>
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
  </svg>
);

export const MessageIcon: React.FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2C6.477 2 2 5.806 2 10.5c0 2.71 1.481 5.123 3.75 6.643v4.425a.75.75 0 0 0 1.25.56l3.541-2.923c.47.051.954.078 1.459.078 5.523 0 10-3.806 10-8.5S17.523 2 12 2z" />
  </svg>
);

export const VerifiedIcon: React.FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="#f59e0b"
    {...props}
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
  </svg>
);
