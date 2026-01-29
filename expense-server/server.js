
//node is like hardware of phone and npm is like ios andriod os of phone
//express is like an app installed on phone which helps to do specific task
//npm init -y  => to create package.json file


const express = require('express');  //import
const app = express();               //object of server
app.use(express.json());             //middleware client data comes in json and gets converted it into javascript object for server

let users = [];                       //array to store users    when user register we add it into this array

// register API
app.post('/register', (request, response) => {       // when resquest on ./register comes run this code 
    const {name, email, password} = request.body;   //register all data coming into body

    if (!name || !email || !password) { 
                      //if value dont exist response message line
        return response.status(400).json({
            message: 'Name, Email, and Password are required.'
        });
    }
    
    //implement logic to check if user with the same email 
    // already exists in the users object
    const user = users.find((u) => u.email === email);  //searching in users array if email already exist
    if (user) {
        return response.status(400).json({
            message: `User with this email already exists. ${email}`
        });
    }
   
//create new user object and add it into users array
    const newUser ={
        id: users.length + 1,
        name: name,
        email: email,
        password: password
    };
    users.push(newUser);   //add new user into users array
    return response.status(200).json({
        message: `User registered ${name}`,
        user: {id: newUser.id}
    });
});

 

    /**
     * createa POST API with path /login which takes in emailand password from 
     * body and checks if user with same email and password exit in the users array
     * if yes return 200 response with message login successful
     * if no return 401 response with message invalid credentials
     */
    app.post('/login', (request, response) => { 
        const {email, password} = request.body;
        if (!email || !password) {
            return response.status(400).json({
                message: 'Email and Password are required.'
            });
        }
        const user = users.find((u) => u.email === email && u.password === password);
        if (user) {
            return response.status(200).json({
                message: 'Login successful'
            });
        } else {
            return response.status(401).json({
                message: 'Invalid credentials'
            });
        }
    });

app.listen(5001, () => {                           //https server ---> ip address(hostel) ----> port(room no)
    console.log('Server is running on port 5001');
});

