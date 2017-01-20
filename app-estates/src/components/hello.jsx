import React from 'react';
import styles from './hello.scss';

export default ({name}) => (
    <p className={styles.text}>hello {name}!</p>
)