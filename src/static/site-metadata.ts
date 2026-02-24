interface ISiteMetadataResult {
  siteTitle: string;
  siteUrl: string;
  description: string;
  logo: string;
  navLinks: {
    name: string;
    url: string;
  }[];
}

const getBasePath = () => {
  const baseUrl = import.meta.env.BASE_URL;
  return baseUrl === '/' ? '' : baseUrl;
};

const data: ISiteMetadataResult = {
  siteTitle: 'Running Page',
  siteUrl: 'https://zhengli-04.github.io/running',
  logo: '',
  description: 'Zheng running page',
  navLinks: [
    {
      name: 'Summary',
      url: `${getBasePath()}/summary`,
    },
  ],
};

export default data;
