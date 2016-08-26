import React, { Component } from 'react';
import classNames from 'classnames';
import StatusPageStyles from '../../../styles/components/shared/c-status-page.scss';

class StatusPage extends Component {

  render() {
    const customClass = this.props.styles;

    return (
      <div
        className={
          classNames({ [StatusPageStyles['c-status-page']]: true, [StatusPageStyles[customClass]]: customClass })
        }
      >
        <div className={StatusPageStyles.message}>
          {this.props.title &&
            <h2 className={StatusPageStyles['title-status']}>{this.props.title}</h2>}
          {this.props.description &&
            <p className={StatusPageStyles.description}>{this.props.description}</p>}
        </div>
      </div>
    );
  }
}

StatusPage.propTypes = {
  title: React.PropTypes.string,
  description: React.PropTypes.string,
  styles: React.PropTypes.string
};

export default StatusPage;
