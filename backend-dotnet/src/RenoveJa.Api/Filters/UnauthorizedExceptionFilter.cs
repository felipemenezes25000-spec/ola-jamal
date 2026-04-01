using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace RenoveJa.Api.Filters;

public class UnauthorizedExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is UnauthorizedAccessException)
        {
            context.Result = new UnauthorizedObjectResult(new { message = "Unauthorized" });
            context.ExceptionHandled = true;
        }
    }
}
