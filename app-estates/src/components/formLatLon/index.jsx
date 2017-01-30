import React from 'react';
import style from './styles.scss';

export default class FromLatLon extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            input: '51.11, 17.022'
        }

        this.handleOnSubmit = this.handleOnSubmit.bind(this);
    }

    handleOnSubmit(e) {
      console.log('submit:', this.refs.input.value);
      this.props.onChange(this.refs.input.value);

      e.preventDefault();
    }

    render() {
        return (
            <form className={style.form} onSubmit={this.handleOnSubmit}>
              <input type="text" ref="input" defaultValue={this.state.input}/>
            </form>
        )
    }
}
