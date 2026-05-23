export type StockManagementConfig = {
  spreadsheetId: string;
  links: { infoUrl: string; chartUrl: string; nepseInfoUrl: string };
  marginStocks: string[];
  marginColor: string;
  stockSecurityMap: Record<string, string>;
};

export const DEFAULT_CONFIG: StockManagementConfig = {
  spreadsheetId: "",
  links: { infoUrl: "", chartUrl: "", nepseInfoUrl: "" },
  marginStocks: [],
  marginColor: "#f59e0b",
  stockSecurityMap: {},
};
