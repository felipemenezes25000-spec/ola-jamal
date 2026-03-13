using System;
using BCrypt.Net;

var pwd = args.Length > 0 ? args[0] : "Teste@123";
Console.WriteLine(BCrypt.Net.BCrypt.HashPassword(pwd, 10));
