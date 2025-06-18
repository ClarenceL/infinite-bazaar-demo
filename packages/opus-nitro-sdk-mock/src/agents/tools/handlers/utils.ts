/**
 * Processes an API response and handles different response types and error states
 * consistently across all tool handlers
 *
 * @param response The fetch Response object to process
 * @returns An object with the processed data and any error information
 */
export async function processApiResponse(response: Response): Promise<{
  data: any;
  error?: string;
  statusCode: number;
  statusText: string;
  isSuccess: boolean;
}> {
  const statusCode = response.status;
  const statusText = response.statusText;
  const isSuccess = response.ok;
  let data: any = {};
  let error: string | undefined = undefined;

  // For successful responses, attempt to parse as JSON
  if (response.ok) {
    try {
      data = await response.json();
    } catch (e) {
      // If not JSON, get as text
      try {
        const textResponse = await response.text();
        data = { message: textResponse };
      } catch (textError) {
        // If all else fails, create a generic success response
        data = { message: "Operation completed successfully" };
      }
    }
    return { data, statusCode, statusText, isSuccess };
  }

  // For non-OK responses, handle by content type
  const contentType = response.headers.get("content-type") || "";

  // Simple text responses (like "404 Not Found")
  if (contentType.includes("text/plain")) {
    const textResponse = await response.text();
    console.log(`Plain text error response: ${textResponse}`);
    error = `API request failed: ${statusCode} ${statusText} - ${textResponse}`;
    data = { error };
  }
  // JSON error responses
  else if (contentType.includes("application/json")) {
    try {
      data = await response.json();
      // If the JSON response doesn't have an error field, add one
      if (!data.error) {
        error = `API request failed with status: ${statusCode} ${statusText}`;
        data.error = error;
      } else {
        error = data.error;
      }
    } catch (parseError) {
      console.error("Error parsing JSON error response:", parseError);
      error = `API request failed with status ${statusCode} ${statusText} (JSON parse error)`;
      data = { error };
    }
  }
  // Other response types
  else {
    try {
      const textResponse = await response.text();
      console.log(`Non-JSON response (${contentType}): ${textResponse.substring(0, 100)}...`);
      error = `API request failed with status: ${statusCode} ${statusText}`;
      data = {
        error,
        responseText:
          textResponse.length > 500 ? `${textResponse.substring(0, 500)}...` : textResponse,
      };
    } catch (e) {
      // Don't let this fail
      error = `API request failed with status: ${statusCode} ${statusText}`;
      data = { error };
    }
  }

  return { data, error, statusCode, statusText, isSuccess };
}
