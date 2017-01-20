import React from 'react';
import styles from './text.scss';

export default ({text}) => (
    <p className={styles.text}>some text: {text}!</p>
)