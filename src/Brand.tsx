export function BrandMark() {
  return <span className="brand-mark" aria-hidden="true">
    <img className="logo-light" src={`${import.meta.env.BASE_URL}logo-mark.svg`} alt="" width="72" height="84"/>
    <img className="logo-dark" src={`${import.meta.env.BASE_URL}logo-mark-dark.svg`} alt="" width="72" height="84"/>
  </span>;
}
export function Brand() {
  return <a className="brand" href={import.meta.env.BASE_URL} aria-label="XFrame Downloader home">
    <BrandMark/><span className="brand-wordmark">XFrame<span>Downloader</span></span>
  </a>;
}
