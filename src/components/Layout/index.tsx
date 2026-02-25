import PropTypes from 'prop-types';
import React from 'react';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import useSiteMetadata from '@/hooks/useSiteMetadata';

const Layout = ({ children }: React.PropsWithChildren) => {
  const { siteTitle, description } = useSiteMetadata();

  return (
    <>
      <Helmet>
        <html lang="en" />
        <title>{siteTitle}</title>
        <meta name="description" content={description} />
        <meta name="keywords" content="running" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
      </Helmet>
      <div className="page-shell">
        <Header />
        <main className="page-content">{children}</main>
        <footer className="page-footer">
          <span>
            致谢：
            <a
              href="https://github.com/yihong0618/running_page"
              target="_blank"
              rel="noreferrer"
            >
              yihong0618/running_page
            </a>
            ，并在此基础上使用 Codex 定制实现。
          </span>
        </footer>
      </div>
    </>
  );
};

Layout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default Layout;
