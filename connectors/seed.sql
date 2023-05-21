-- Insert Roles
INSERT INTO roles("role")
	VALUES ('user');
INSERT INTO roles("role")
	VALUES ('admin');
INSERT INTO roles("role")
	VALUES ('senior');	
-- Set user role as Admin
    
INSERT INTO public.users(
	firstname, lastname, email, password, roleid)
	VALUES ('rawna', 'alaa', 'desoukya@gmail.com', '22222', 4);

UPDATE users
	SET "roleid"=4
	WHERE "email"='desoukya@gmail.com';