import type { Metadata } from "next";
import { notFound } from "next/navigation";
import App from "../../App";
import { parseRoutePath, routeTitles } from "../../lib/routing";

type PageProps = {
  params: Promise<{ path: string[] }>;
};

const pathFromParams = (segments: string[]) => `/${segments.join("/")}`;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { path } = await params;
  const state = parseRoutePath(pathFromParams(path));
  const assetTitle = state.selectedSymbol ? `${state.selectedSymbol} Research` : routeTitles[state.route];
  return {
    title: assetTitle,
    alternates: {
      canonical: pathFromParams(path)
    },
    openGraph: {
      title: `${assetTitle} | Market Signal Deck`
    }
  };
}

export default async function RoutedPage({ params }: PageProps) {
  const { path } = await params;
  const initialPath = pathFromParams(path);
  const state = parseRoutePath(initialPath);

  if (state.invalid) {
    notFound();
  }

  return <App initialPath={initialPath} />;
}
