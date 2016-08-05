import React, { Component } from 'react';
import Header from '../containers/header';
import Footer from './shared/footer';
import { Link } from 'react-router';
import listposts from '../../styles/components/c-list-posts.scss';
import CoverBlog from './blog/cover_blog';
import PaginationBlog from './blog/pagination';
import boxtriangle from '../../assets/icons/box_triangle.svg';

class Blog extends Component {

  componentDidMount() {
    this.props.getRecentPost();
  }

  render() {
    let articles = [];

    if (this.props.recentPost) {
      articles = this.props.recentPost.posts.map((article) => (
        <article>
          <Link to={`/blog/${article.slug}`}>
            <h2>{article.title}</h2>
          </Link>
          <span className={listposts.datapost}>{article.date.substr(0, 10)}</span>
          <span
            dangerouslySetInnerHTML={{
              __html: article.excerpt
            }}
          />
          <p className={listposts['button-more']}>
            <Link to={`/blog/${article.slug}`}>
              <img
                alt="Find out more"
                src={boxtriangle}
              />
              FIND OUT MORE
            </Link>
          </p>
          <hr />
        </article>
      ));
    } else {
      articles = (<div>Loading....</div>);
    }

    return (<div>
      <Header />
      <CoverBlog />
      <section className={listposts['c-list-posts']}>
        {articles}
      </section>
      <PaginationBlog />
      <Footer />
    </div>);
  }
}

Blog.propTypes = {
  recentPost: React.PropTypes.object,
  getRecentPost: React.PropTypes.func
};


export default Blog;
