import React from 'react';
import { createRoot } from 'react-dom/client';
import WriterV3 from './WriterV3';
import './style.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><WriterV3 /></React.StrictMode>);
