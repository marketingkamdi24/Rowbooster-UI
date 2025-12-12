export interface FileUploadData {
  ArticleNumber?: string; // Make ArticleNumber optional
  ProductName: string;
  [key: string]: string | undefined;
}
