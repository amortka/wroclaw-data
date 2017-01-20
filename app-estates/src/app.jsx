import styles from './index.scss';
import React from 'react';

import Hello from './components/hello';
import Text from './components/text';
import Button from './components/button';

export default class App extends React.Component {
    render() {
        return (
            <div>
                <h1>It Works!</h1>
                <p>This React project just works including <span className={styles.redBg}>module</span> local styles.</p>
                <Hello name="John"/>
                <Text text="some dummy text"/>
                <Button message="123"/>
                <p>Enjoy!</p>
            </div>
        )
    }
}